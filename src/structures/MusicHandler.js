const Rest = require("./Rest");
const util = require("../util");
const message = require("../listeners/message");
const db = require("quick.db");
const FiltersValues = require("../constants/FiltersValues");

const { Database } = require("quickmongo");
const mongo = new Database(process.env.MONGO_URI);
function importData() {
    const data = db.all();
    mongo.import(data).then(() => {
        console.log("Done!");
    });    
}

mongo.on("ready", () => importData());

module.exports = class MusicHandler {
    /** @param {import("discord.js").Guild} guild */
    constructor(guild) {
        this.guild = guild;
        this.volume = 100;
        this.loop = false;
        this.previous = null;
        this.nightcore = false;
        this.vaporwave = false;
        this._8d = false;
        this.bassboost = false;
        this.current = null;
        this.queue = [];
        /** @type {import("discord.js").TextChannel|null} */
        this.textChannel = null;
    }

    get voiceChannel() {
        return this.guild.me.voice.channel;
    }

    /** @returns {import("../structures/MusicClient")} */
    get client() {
        return this.guild.client;
    }

    get player() {
        return this.client.manager.players.get(this.guild.id) || null;
    }

    get node() {
        return this.client.manager.nodes.get("main");
    }

    reset() {
        this.loop = false;
        this.volume = 100;
        this.previous = null;
        this.current = null;
        this.queue = [];
         this.nightcore = false;
        this.vaporwave = false;
        this._8d = false;
        this.textChannel = null;
    }

    /** @param {import("discord.js").VoiceChannel} voice */
    async join(voice) {
        if (this.player) return;
        await this.client.manager.join({
            channel: voice.id,
            guild: this.guild.id,
            node: this.node.id
        }, { selfdeaf: true });

        this.player
            .on("start", () => {
                this.current = this.queue.shift();
                if (this.textChannel) this.textChannel.send(util.embed()
                    .setAuthor(" | Now playing ", this.client.user.displayAvatarURL())
                    .setDescription(`[${this.current.info.title}](${this.current.info.uri})`)
                );
            })
           .on("end", (data) => {
                if (data.reason === "REPLACED") return;
                this.previous = this.current;
                this.current = null;

                if (this.loop === 1 && !this.shouldSkipCurrent) this.queue.unshift(this.previous);
                else if (this.loop === 2) this.queue.push(this.previous);

                if (this.shouldSkipCurrent) this.shouldSkipCurrent = false;

                if (!this.queue.length) {
                    this.client.manager.leave(this.guild.id);
                    if (this.textChannel) this.textChannel.send(util.embed().setDescription("✅ | Queue is empty "));
                    this.reset();
                    return;
                }
                this.start();
            })
            .on("error", console.error);
    }

    /** @param {import("discord.js").TextChannel} text */
    setTextCh(text) {
        this.textChannel = text;
    }

    async load(query) {
        const res = await Rest.load(this.node, query, this.client.spotify);
        return res;
    }

    async start() {
        if (!this.player) return;
        await this.player.play(this.queue[0].track);
    }

    async pause() {
        if (!this.player) return;
        if (!this.player.paused) await this.player.pause(true);
    }

    async resume() {
        if (!this.player) return;
        if (this.player.paused) await this.player.pause(false);
    }

    async skip(num = 1) {
        if (!this.player) return;
        if (num > 1) {
            this.queue.unshift(this.queue[num - 1]);
            this.queue.splice(num, 1);
        } 
        await this.player.stop();
    }

    async stop() {
        if (!this.player) return;
        this.loop = false;
        this.queue = [];
    this.vaporwave = false;
        this.nightcore = false;
        this._8d = false;
        await this.skip();
    }

    async setVolume(newVol) {
        if (!this.player) return;
        const parsed = parseInt(newVol, 10);
        if (isNaN(parsed)) return;
        await this.player.volume(parsed);
        this.volume = newVol;
    }
    async setNightcore(val) {
        if(val === true){
            this.vaporwave = false;
            this._8d = false;
            this.bassboost = false;
            this.player.node.send({
                op: "filters",
                guildId: this.guild.id || this.guild,
                timescale: { speed: 1.1999999523162842, pitch: 1.2999999523163953, rate: 1 },
            });
            this.nightcore = true;
        }
        else if(val === false){
            this.player.node.send({
                op: "filters",
                guildId: this.guild.id || this.guild,
            });
            this.nightcore = false;
        }
        else return;
    }

    async setVaporwave(val) {
        if(val === true){
            this.nightcore = false;
            this._8d = false;
            this.bassboost = false;
            this.player.node.send({
                op: "filters",
                guildId: this.guild.id || this.guild,
                timescale: { speed:0.8500000238418579, pitch: 0.800000011920929, rate: 1 },
            });
            this.vaporwave = true;
        }
        else if(val === false){
            this.player.node.send({
                op: "filters",
                guildId: this.guild.id || this.guild,
            });
            this.vaporwave = false;
        }
        else return;
    }

    async set8D(val) {
        if(val === true){
            this.vaporwave = false;
            this.nightcore = false;
            this.bassboost = false;
            this.player.node.send({
                op: "filters",
                guildId: this.guild.id || this.guild,
                rotation : { rotationHz: 0.29999 },
            });
            this._8d = true;
        }
        else if(val === false){
            this.player.node.send({
                op: "filters",
                guildId: this.guild.id || this.guild,
            });
            this._8d = false;
        }
        else return;
    }

    async setBassboost(bassboost) {
        if (bassboost) {
            this.nightcore = false;
            this.vaporwave = false;
            this._8d = false;
            this.set8D(false);
            this.setNightcore(false);
            this.setNightcore(false);
            this.player.equalizer(Array(3).fill(null).map((n, i) => ({ band: i, gain: bassboost })));
            this.bassboost = bassboost;
        } else this.player.node.send({
            op: "filters",
            guildId: this.guild.id || this.guild,
        });
        this.bassboost = bassboost;
        return this;
    }
};
